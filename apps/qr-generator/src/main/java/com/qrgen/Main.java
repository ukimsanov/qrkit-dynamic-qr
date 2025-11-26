package com.qrgen;

import com.google.zxing.qrcode.decoder.Mode;

/**
 * Simple command-line QR code generator
 * Usage: java -jar qr-generator.jar "Your text here" [output.png]
 */
public class Main {
    
    public static void main(String[] args) {
        if (args.length == 0) {
            printUsage();
            System.exit(1);
        }
        
        try {
            String data = args[0];
            String outputPath = args.length > 1 ? args[1] : "qrcode.png";
            
            QRCodeGenerator generator = new QRCodeGenerator();
            QRCodeGenerator.QRResult result = generator.generateQRCode(data, outputPath);
            
            // Output result
            System.out.println("QR Code generated successfully!");
            System.out.println("Output: " + result.filePath);
            System.out.println("Mode: " + result.mode + " | Version: " + result.version + " | Size: " + data.length() + " " + (result.mode == Mode.BYTE ? "bytes" : "chars"));
            
        } catch (IllegalArgumentException e) {
            System.err.println("Error: " + e.getMessage());
            System.err.println();
            printCapacityInfo();
            System.exit(1);
        } catch (Exception e) {
            System.err.println("Error generating QR code: " + e.getMessage());
            System.exit(1);
        }
    }
    
    private static void printUsage() {
        System.out.println("QR Code Generator");
        System.out.println();
        System.out.println("Usage:");
        System.out.println("  java -jar qr-generator.jar <text> [output.png]");
        System.out.println();
        System.out.println("Examples:");
        System.out.println("  java -jar qr-generator.jar \"HELLO WORLD\"");
        System.out.println("  java -jar qr-generator.jar \"hello@example.com\" myqr.png");
        System.out.println();
        printCapacityInfo();
    }
    
    private static void printCapacityInfo() {
        System.out.println("Maximum Capacity (Version 3, Error Correction L):");
        System.out.println("  - Byte mode: " + QRCodeGenerator.getMaxCapacity(Mode.BYTE) + " bytes");
        System.out.println("  - Alphanumeric mode: " + QRCodeGenerator.getMaxCapacity(Mode.ALPHANUMERIC) + " characters");
        System.out.println("  - Alphanumeric: 0-9, A-Z, space, $ % * + - . / :");
    }
}
