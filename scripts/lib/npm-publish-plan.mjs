const STABLE_VERSION_REGEX = /^(?<year>\d{4})\.(?<month>[1-9]\d?)\.(?<day>[1-9]\d?)$/;
const BETA_VERSION_REGEX =
  /^(?<year>\d{4})\.(?<month>[1-9]\d?)\.(?<day>[1-9]\d?)-beta\.(?<beta>[1-9]\d*)$/;
const VERIFIED_VERSION_REGEX =
  /^(?<year>\d{4})\.(?<month>[1-9]\d?)\.(?<day>[1-9]\d?)-verified\.(?<verified>[1-9]\d*)$/;
const CORRECTION_VERSION_REGEX =
  /^(?<year>\d{4})\.(?<month>[1-9]\d?)\.(?<day>[1-9]\d?)-(?<correction>[1-9]\d*)$/;

/**
 * @typedef {object} ParsedReleaseVersion
 * @property {string} version
 * @property {string} baseVersion
 * @property {"stable" | "beta" | "verified"} channel
 * @property {number} year
 * @property {number} month
 * @property {number} day
 * @property {number | undefined} [betaNumber]
 * @property {number | undefined} [verifiedNumber]
 * @property {number | undefined} [correctionNumber]
 * @property {Date} date
 */

/**
 * @typedef {object} NpmPublishPlan
 * @property {"stable" | "beta"} channel
 * @property {"latest" | "beta"} publishTag
 * @property {("latest" | "beta")[]} mirrorDistTags
 */

/**
 * @typedef {object} NpmDistTagMirrorAuth
 * @property {boolean} hasAuth
 * @property {"node-auth-token" | "npm-token" | "none"} source
 */

/**
 * @typedef {"--dry-run" | "--publish"} NpmPublishMode
 */

/**
 * @param {string} version
 * @param {Record<string, string | undefined>} groups
 * @param {"stable" | "beta"} channel
 * @returns {ParsedReleaseVersion | null}
 */
function parseDateParts(version, groups, channel) {
  const year = Number.parseInt(groups.year ?? "", 10);
  const month = Number.parseInt(groups.month ?? "", 10);
  const day = Number.parseInt(groups.day ?? "", 10);
  const betaNumber = channel === "beta" ? Number.parseInt(groups.beta ?? "", 10) : undefined;
  const verifiedNumber =
    channel === "verified" ? Number.parseInt(groups.verified ?? "", 10) : undefined;

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  if (channel === "beta" && (!Number.isInteger(betaNumber) || (betaNumber ?? 0) < 1)) {
    return null;
  }
  if (channel === "verified" && (!Number.isInteger(verifiedNumber) || (verifiedNumber ?? 0) < 1)) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    version,
    baseVersion: `${year}.${month}.${day}`,
    channel,
    year,
    month,
    day,
    betaNumber,
    verifiedNumber,
    date,
  };
}

/**
 * @param {string} version
 * @returns {ParsedReleaseVersion | null}
 */
export function parseReleaseVersion(version) {
  const trimmed = version.trim();
  if (!trimmed) {
    return null;
  }

  const stableMatch = STABLE_VERSION_REGEX.exec(trimmed);
  if (stableMatch?.groups) {
    return parseDateParts(trimmed, stableMatch.groups, "stable");
  }

  const betaMatch = BETA_VERSION_REGEX.exec(trimmed);
  if (betaMatch?.groups) {
    return parseDateParts(trimmed, betaMatch.groups, "beta");
  }

  const verifiedMatch = VERIFIED_VERSION_REGEX.exec(trimmed);
  if (verifiedMatch?.groups) {
    return parseDateParts(trimmed, verifiedMatch.groups, "verified");
  }

  const correctionMatch = CORRECTION_VERSION_REGEX.exec(trimmed);
  if (correctionMatch?.groups) {
    const parsedCorrection = parseDateParts(trimmed, correctionMatch.groups, "stable");
    const correctionNumber = Number.parseInt(correctionMatch.groups.correction ?? "", 10);
    if (parsedCorrection === null || !Number.isInteger(correctionNumber) || correctionNumber < 1) {
      return null;
    }

    return {
      ...parsedCorrection,
      correctionNumber,
    };
  }

  return null;
}

/**
 * @param {string} left
 * @param {string} right
 * @returns {number | null}
 */
export function compareReleaseVersions(left, right) {
  const parsedLeft = parseReleaseVersion(left);
  const parsedRight = parseReleaseVersion(right);
  if (parsedLeft === null || parsedRight === null) {
    return null;
  }

  const dateDelta = parsedLeft.date.getTime() - parsedRight.date.getTime();
  if (dateDelta !== 0) {
    return Math.sign(dateDelta);
  }

  const channelOrder = { beta: 0, verified: 1, stable: 2 };
  if (parsedLeft.channel !== parsedRight.channel) {
    return Math.sign(
      (channelOrder[parsedLeft.channel] ?? 0) - (channelOrder[parsedRight.channel] ?? 0),
    );
  }

  if (parsedLeft.channel === "beta" && parsedRight.channel === "beta") {
    return Math.sign((parsedLeft.betaNumber ?? 0) - (parsedRight.betaNumber ?? 0));
  }

  if (parsedLeft.channel === "verified" && parsedRight.channel === "verified") {
    return Math.sign((parsedLeft.verifiedNumber ?? 0) - (parsedRight.verifiedNumber ?? 0));
  }

  return Math.sign((parsedLeft.correctionNumber ?? 0) - (parsedRight.correctionNumber ?? 0));
}

/**
 * @param {string} version
 * @param {string | null} [currentBetaVersion]
 * @returns {NpmPublishPlan}
 */
export function resolveNpmPublishPlan(version, currentBetaVersion) {
  const parsedVersion = parseReleaseVersion(version);
  if (parsedVersion === null) {
    throw new Error(`Unsupported release version "${version}".`);
  }

  if (parsedVersion.channel === "beta") {
    return {
      channel: "beta",
      publishTag: "beta",
      mirrorDistTags: [],
    };
  }

  if (parsedVersion.channel === "verified") {
    const normalizedCurrentBeta = currentBetaVersion?.trim();
    if (normalizedCurrentBeta) {
      const betaVsVerified = compareReleaseVersions(normalizedCurrentBeta, version);
      if (betaVsVerified !== null && betaVsVerified > 0) {
        return {
          channel: "verified",
          publishTag: "latest",
          mirrorDistTags: [],
        };
      }
    }

    return {
      channel: "verified",
      publishTag: "latest",
      mirrorDistTags: ["beta"],
    };
  }

  const normalizedCurrentBeta = currentBetaVersion?.trim();
  if (normalizedCurrentBeta) {
    const betaVsStable = compareReleaseVersions(normalizedCurrentBeta, version);
    if (betaVsStable !== null && betaVsStable > 0) {
      return {
        channel: "stable",
        publishTag: "latest",
        mirrorDistTags: [],
      };
    }
  }

  return {
    channel: "stable",
    publishTag: "latest",
    mirrorDistTags: ["beta"],
  };
}

/**
 * @param {{
 *   nodeAuthToken?: string | null | undefined;
 *   npmToken?: string | null | undefined;
 * }} [params]
 * @returns {NpmDistTagMirrorAuth}
 */
export function resolveNpmDistTagMirrorAuth(params = {}) {
  const nodeAuthToken = params.nodeAuthToken?.trim();
  if (nodeAuthToken) {
    return { hasAuth: true, source: "node-auth-token" };
  }

  const npmToken = params.npmToken?.trim();
  if (npmToken) {
    return { hasAuth: true, source: "npm-token" };
  }

  return { hasAuth: false, source: "none" };
}

/**
 * @param {{
 *   mode: NpmPublishMode;
 *   mirrorDistTags: string[] | readonly string[];
 *   hasAuth: boolean;
 * }} params
 * @returns {boolean}
 */
export function shouldRequireNpmDistTagMirrorAuth(params) {
  return (
    params.mode === "--publish" &&
    params.mirrorDistTags.some((distTag) => distTag.trim().length > 0) &&
    !params.hasAuth
  );
}
