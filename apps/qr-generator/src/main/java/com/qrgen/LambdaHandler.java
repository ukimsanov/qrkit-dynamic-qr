package com.qrgen;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.zxing.qrcode.decoder.Mode;

import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/**
 * AWS Lambda handler for QR code generation API.
 * Integrates with API Gateway to receive HTTP requests and return QR code images.
 */
public class LambdaHandler implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {

    private final QRCodeGenerator generator = new QRCodeGenerator();
    private final Gson gson = new Gson();

    @Override
    public APIGatewayProxyResponseEvent handleRequest(APIGatewayProxyRequestEvent input, Context context) {
        APIGatewayProxyResponseEvent response = new APIGatewayProxyResponseEvent();
        Map<String, String> headers = new HashMap<>();
        headers.put("Content-Type", "application/json");
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Access-Control-Allow-Methods", "POST, OPTIONS");
        headers.put("Access-Control-Allow-Headers", "Content-Type");
        response.setHeaders(headers);

        try {
            // Handle OPTIONS preflight request
            if ("OPTIONS".equals(input.getHttpMethod())) {
                return response.withStatusCode(200).withBody("{}");
            }

            // Parse request body
            String body = input.getBody();
            if (body == null || body.isEmpty()) {
                return createErrorResponse(response, 400, "Request body is required");
            }

            JsonObject requestData = gson.fromJson(body, JsonObject.class);

            // Validate required field
            if (!requestData.has("text") || requestData.get("text").isJsonNull()) {
                return createErrorResponse(response, 400, "Field 'text' is required");
            }

            String text = requestData.get("text").getAsString();

            if (text.isEmpty()) {
                return createErrorResponse(response, 400, "Field 'text' cannot be empty");
            }

            // Optional: specify mode (BYTE or ALPHANUMERIC)
            Mode mode = null;
            if (requestData.has("mode") && !requestData.get("mode").isJsonNull()) {
                String modeStr = requestData.get("mode").getAsString().toUpperCase();
                try {
                    mode = Mode.valueOf(modeStr);
                } catch (IllegalArgumentException e) {
                    return createErrorResponse(response, 400, "Invalid mode. Supported: BYTE, ALPHANUMERIC");
                }
            }

            // Generate QR code to byte array
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            QRCodeGenerator.QRResult result;

            if (mode != null) {
                result = generator.generateQRCodeToStream(text, outputStream, mode);
            } else {
                result = generator.generateQRCodeToStream(text, outputStream);
            }

            // Convert to base64 data URL
            byte[] qrImageBytes = outputStream.toByteArray();
            String base64Image = Base64.getEncoder().encodeToString(qrImageBytes);
            String dataUrl = "data:image/png;base64," + base64Image;

            // Build success response
            JsonObject responseData = new JsonObject();
            responseData.addProperty("success", true);
            responseData.addProperty("dataUrl", dataUrl);
            responseData.addProperty("version", result.version);
            responseData.addProperty("mode", result.mode.toString());
            responseData.addProperty("size", text.length());

            response.setStatusCode(200);
            response.setBody(gson.toJson(responseData));

            return response;

        } catch (IllegalArgumentException e) {
            // Capacity exceeded or invalid input
            context.getLogger().log("Validation error: " + e.getMessage());
            return createErrorResponse(response, 400, e.getMessage());

        } catch (Exception e) {
            // Unexpected error
            context.getLogger().log("Error generating QR code: " + e.getMessage());
            return createErrorResponse(response, 500, "Internal server error: " + e.getMessage());
        }
    }

    /**
     * Creates an error response with the given status code and message
     */
    private APIGatewayProxyResponseEvent createErrorResponse(
            APIGatewayProxyResponseEvent response, int statusCode, String message) {
        JsonObject errorData = new JsonObject();
        errorData.addProperty("success", false);
        errorData.addProperty("error", message);

        response.setStatusCode(statusCode);
        response.setBody(gson.toJson(errorData));

        return response;
    }
}
