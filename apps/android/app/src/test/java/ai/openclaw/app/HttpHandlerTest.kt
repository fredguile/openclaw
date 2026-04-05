package ai.openclaw.app

import ai.openclaw.app.node.HttpHandler
import ai.openclaw.app.protocol.OpenClawHttpCommand
import com.nhaarman.mockitokotlin2.any
import com.nhaarman.mockitokotlin2.mock
import com.nhaarman.mockitokotlin2.whenever
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.UnknownHostException

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class HttpHandlerTest {
  private val handler = HttpHandler()

  @Test
  fun handles_GET_request_successfully() {
    val mockConnection = mock<HttpURLConnection>()
    whenever(mockConnection.responseCode).thenReturn(200)
    whenever(mockConnection.responseMessage).thenReturn("OK")
    whenever(mockConnection.headerFields).thenReturn(
      mapOf(
        "Content-Type" to listOf("application/json"),
        "X-Custom" to listOf("value")
      )
    )
    whenever(mockConnection.inputStream).thenReturn(ByteArrayInputStream("""{"success":true}""".toByteArray()))

    val mockUrl = mock<URL>()
    whenever(mockUrl.openConnection()).thenReturn(mockConnection)

    val result = handler.handleHttpRequest("""{"url":"http://example.com/api","method":"GET"}""")

    assertNotNull(result)
    assertTrue(result.ok)
    assertTrue(result.payload?.contains("\"status\":200") ?: false)
    assertTrue(result.payload?.contains("\"statusText\":\"OK\"") ?: false)
  }

  @Test
  fun rejects_non_http_URLs() {
    val result = handler.handleHttpRequest("""{"url":"ftp://example.com/file"}""")

    assertNotNull(result)
    assertFalse(result.ok)
    assertTrue(result.message?.contains("INVALID_REQUEST") ?: false)
    assertTrue(result.message?.contains("http or https") ?: false)
  }

  @Test
  fun handles_DNS_error_gracefully() {
    val result = handler.handleHttpRequest("""{"url":"http://nonexistent.invalid/path"}""")

    assertNotNull(result)
    assertFalse(result.ok)
    assertTrue(result.message?.contains("DNS_ERROR") ?: false)
  }

  @Test
  fun handles_connection_timeout() {
    val result = handler.handleHttpRequest("""{"url":"http://example.com/slow","timeout":1}""")

    assertNotNull(result)
    assertFalse(result.ok)
    assertTrue(result.message?.contains("TIMEOUT") ?: false)
  }

  @Test
  fun respects_timeout_parameter() {
    val mockConnection = mock<HttpURLConnection>()
    whenever(mockConnection.responseCode).thenReturn(200)
    whenever(mockConnection.responseMessage).thenReturn("OK")
    whenever(mockConnection.headerFields).thenReturn(emptyMap())
    whenever(mockConnection.inputStream).thenReturn(ByteArrayInputStream("{}".toByteArray()))

    val mockUrl = mock<URL>()
    whenever(mockUrl.openConnection()).thenReturn(mockConnection)

    val result = handler.handleHttpRequest("""{"url":"http://example.com/api","timeout":5000}""")

    assertNotNull(result)
  }

  @Test
  fun parses_headers_correctly() {
    val mockConnection = mock<HttpURLConnection>()
    whenever(mockConnection.responseCode).thenReturn(200)
    whenever(mockConnection.responseMessage).thenReturn("OK")
    whenever(mockConnection.headerFields).thenReturn(
      mapOf(
        "Content-Type" to listOf("application/json"),
        "X-Custom" to listOf("value1", "value2")
      )
    )
    whenever(mockConnection.inputStream).thenReturn(ByteArrayInputStream("{}".toByteArray()))

    val mockUrl = mock<URL>()
    whenever(mockUrl.openConnection()).thenReturn(mockConnection)

    val result = handler.handleHttpRequest(
      """{"url":"http://example.com/api","headers":{"Authorization":"Bearer token","X-Req":"test"}}"""
    )

    assertNotNull(result)
    assertTrue(result.ok)
  }

  @Test
  fun truncates_body_to_MAX_BODY_SIZE_BYTES() {
    val largeBody = "x".repeat(6 * 1024 * 1024)
    val mockConnection = mock<HttpURLConnection>()
    whenever(mockConnection.responseCode).thenReturn(200)
    whenever(mockConnection.responseMessage).thenReturn("OK")
    whenever(mockConnection.headerFields).thenReturn(emptyMap())
    whenever(mockConnection.inputStream).thenReturn(ByteArrayInputStream(largeBody.toByteArray()))

    val mockUrl = mock<URL>()
    whenever(mockUrl.openConnection()).thenReturn(mockConnection)

    val result = handler.handleHttpRequest("""{"url":"http://example.com/large"}""")

    assertNotNull(result)
  }

  @Test
  fun supports_POST_with_body() {
    val mockConnection = mock<HttpURLConnection>()
    whenever(mockConnection.responseCode).thenReturn(201)
    whenever(mockConnection.responseMessage).thenReturn("Created")
    whenever(mockConnection.headerFields).thenReturn(emptyMap())
    whenever(mockConnection.inputStream).thenReturn(ByteArrayInputStream("""{"id":123}""".toByteArray()))

    val mockUrl = mock<URL>()
    whenever(mockUrl.openConnection()).thenReturn(mockConnection)

    val result = handler.handleHttpRequest(
      """{"url":"http://example.com/api","method":"POST","body":"{\"name\":\"test\"}"}"""
    )

    assertNotNull(result)
    assertTrue(result.ok)
    assertTrue(result.payload?.contains("\"status\":201") ?: false)
  }

  @Test
  fun returns_correct_status_and_statusText() {
    val mockConnection = mock<HttpURLConnection>()
    whenever(mockConnection.responseCode).thenReturn(404)
    whenever(mockConnection.responseMessage).thenReturn("Not Found")
    whenever(mockConnection.headerFields).thenReturn(emptyMap())
    whenever(mockConnection.inputStream).thenReturn(null as InputStream?)
    whenever(mockConnection.errorStream).thenReturn(ByteArrayInputStream("Not Found".toByteArray()))

    val mockUrl = mock<URL>()
    whenever(mockUrl.openConnection()).thenReturn(mockConnection)

    val result = handler.handleHttpRequest("""{"url":"http://example.com/missing"}""")

    assertNotNull(result)
    assertFalse(result.ok)
    assertTrue(result.payload?.contains("\"status\":404") ?: false)
    assertTrue(result.payload?.contains("\"statusText\":\"Not Found\"") ?: false)
  }
}
