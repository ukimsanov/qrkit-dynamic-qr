# QR Code Generator

A Java command-line application that generates QR codes with byte or alphanumeric encoding.

## Features

- **Dual Encoding Modes**: Byte mode (53 bytes max) or Alphanumeric mode (77 chars max)
- **Auto-Detection**: Automatically selects the most efficient encoding
- **Version 3 or Lower**: QR codes restricted to version 3 or lower
- **Error Correction Level L**: Optimized for clean scanning conditions
- **iPhone Compatible**: Standard QR format scannable by any smartphone

## Quick Start

### Navigate to the qr-generator directory

```
cd qr-generator
```

Do this before running the following commands.

### Build
```bash
.\build.bat
```

### Generate a QR Code
```bash
java -cp "lib\*;target\qr-generator.jar" com.qrgen.Main "Your text here"
```

The QR code will be saved as `qrcode.png` in the current directory.

## Usage

```bash
java -cp "lib\*;target\qr-generator.jar" com.qrgen.Main <text> [output.png]
```

**Arguments:**
- `<text>` - The text to encode (required)
- `[output.png]` - Output filename (optional, defaults to `qrcode.png`)

**Examples:**
```bash
# Generate QR code with alphanumeric data
java -cp "lib\*;target\qr-generator.jar" com.qrgen.Main "HELLO WORLD 123"

# Generate QR code with email (byte mode)
java -cp "lib\*;target\qr-generator.jar" com.qrgen.Main "hello@example.com" email-qr.png
```

## Maximum Capacity

| Mode | Version 3 Max Capacity |
|------|------------------------|
| Byte | 53 bytes |
| Alphanumeric | 77 characters |

**Alphanumeric mode supports:** 0-9, A-Z (uppercase), space, and `$ % * + - . / :`

## Project Structure

```
qr-generator/
├── src/main/java/com/qrgen/
│   ├── QRCodeGenerator.java    # Core QR generation logic
│   └── Main.java                # Command-line interface
├── pom.xml                      # Maven configuration
├── build.bat                    # Build script (downloads dependencies)
└── README.md                    # This file
```

## Dependencies

- **Java 11+** required
- **ZXing 3.5.3** (downloaded automatically by build script)

## Building with Maven (Optional)

If you have Maven installed:
```bash
mvn clean package
java -jar target/qr-generator-1.0.0-jar-with-dependencies.jar "Your text"
```

## License

Open source - use freely.
