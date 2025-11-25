package com.qrgen;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import com.google.zxing.qrcode.decoder.Mode;

import java.io.IOException;
import java.nio.file.FileSystems;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * QR Code Generator that supports byte and alphanumeric encoding modes.
 * Restricted to QR version 3 or lower with error correction level L.
 */
public class QRCodeGenerator {
    
    private static final int MAX_VERSION = 3;
    private static final ErrorCorrectionLevel ERROR_CORRECTION = ErrorCorrectionLevel.L;
    
    // Maximum capacities for each version with error correction L
    private static final int[] BYTE_CAPACITY = {17, 32, 53}; // Version 1, 2, 3
    private static final int[] ALPHANUMERIC_CAPACITY = {25, 47, 77}; // Version 1, 2, 3
    
    // Alphanumeric characters: 0-9, A-Z (uppercase), space, and $ % * + - . / :
    private static final Pattern ALPHANUMERIC_PATTERN = Pattern.compile("^[0-9A-Z $%*+\\-./:]*$");
    
    /**
     * Result object containing generation details
     */
    public static class QRResult {
        public final String filePath;
        public final int version;
        public final Mode mode;
        
        public QRResult(String filePath, int version, Mode mode) {
            this.filePath = filePath;
            this.version = version;
            this.mode = mode;
        }
    }
    
    /**
     * Generates a QR code with automatic mode detection
     * 
     * @param data The string data to encode
     * @param outputPath The output file path for the PNG image
     * @return QRResult containing generation details
     * @throws IllegalArgumentException if data exceeds capacity
     * @throws IOException if file writing fails
     * @throws WriterException if QR code generation fails
     */
    public QRResult generateQRCode(String data, String outputPath) 
            throws IOException, WriterException {
        Mode mode = detectOptimalMode(data);
        return generateQRCode(data, outputPath, mode);
    }
    
    /**
     * Generates a QR code with specified encoding mode
     * 
     * @param data The string data to encode
     * @param outputPath The output file path for the PNG image
     * @param mode The encoding mode (BYTE or ALPHANUMERIC)
     * @return QRResult containing generation details
     * @throws IllegalArgumentException if data exceeds capacity or mode is invalid
     * @throws IOException if file writing fails
     * @throws WriterException if QR code generation fails
     */
    public QRResult generateQRCode(String data, String outputPath, Mode mode) 
            throws IOException, WriterException {
        
        if (mode != Mode.BYTE && mode != Mode.ALPHANUMERIC) {
            throw new IllegalArgumentException("Only BYTE and ALPHANUMERIC modes are supported");
        }
        
        // Validate data against mode
        if (mode == Mode.ALPHANUMERIC && !isAlphanumeric(data)) {
            throw new IllegalArgumentException(
                "Data contains characters not supported in alphanumeric mode. " +
                "Alphanumeric supports: 0-9, A-Z, space, and $ % * + - . / :"
            );
        }
        
        // Determine required version based on data length and mode
        int version = getRequiredVersion(data, mode);
        
        if (version > MAX_VERSION) {
            int maxCapacity = mode == Mode.BYTE ? 
                BYTE_CAPACITY[MAX_VERSION - 1] : ALPHANUMERIC_CAPACITY[MAX_VERSION - 1];
            throw new IllegalArgumentException(
                String.format("Data exceeds maximum capacity. Mode: %s, Max capacity: %d %s, Your data: %d %s",
                    mode, maxCapacity, mode == Mode.BYTE ? "bytes" : "characters",
                    data.length(), mode == Mode.BYTE ? "bytes" : "characters")
            );
        }
        
        // Configure QR code generation
        Map<EncodeHintType, Object> hints = new HashMap<>();
        hints.put(EncodeHintType.ERROR_CORRECTION, ERROR_CORRECTION);
        hints.put(EncodeHintType.QR_VERSION, version);
        
        // Generate QR code
        QRCodeWriter qrCodeWriter = new QRCodeWriter();
        BitMatrix bitMatrix = qrCodeWriter.encode(data, BarcodeFormat.QR_CODE, 300, 300, hints);
        
        // Write to file
        Path path = FileSystems.getDefault().getPath(outputPath);
        MatrixToImageWriter.writeToPath(bitMatrix, "PNG", path);
        
        return new QRResult(outputPath, version, mode);
    }
    
    /**
     * Detects the optimal encoding mode for the given data
     * Prefers alphanumeric mode when possible (more efficient)
     */
    private Mode detectOptimalMode(String data) {
        return isAlphanumeric(data) ? Mode.ALPHANUMERIC : Mode.BYTE;
    }
    
    /**
     * Checks if data contains only alphanumeric characters
     */
    private boolean isAlphanumeric(String data) {
        return ALPHANUMERIC_PATTERN.matcher(data).matches();
    }
    
    /**
     * Determines the minimum QR version needed for the data
     */
    private int getRequiredVersion(String data, Mode mode) {
        int dataLength = data.length();
        int[] capacities = mode == Mode.BYTE ? BYTE_CAPACITY : ALPHANUMERIC_CAPACITY;
        
        for (int i = 0; i < capacities.length; i++) {
            if (dataLength <= capacities[i]) {
                return i + 1; // Version is 1-indexed
            }
        }
        
        return MAX_VERSION + 1; // Exceeds max version
    }
    
    /**
     * Gets the maximum capacity for a given mode
     */
    public static int getMaxCapacity(Mode mode) {
        if (mode == Mode.BYTE) {
            return BYTE_CAPACITY[MAX_VERSION - 1];
        } else if (mode == Mode.ALPHANUMERIC) {
            return ALPHANUMERIC_CAPACITY[MAX_VERSION - 1];
        }
        throw new IllegalArgumentException("Unsupported mode: " + mode);
    }
}
