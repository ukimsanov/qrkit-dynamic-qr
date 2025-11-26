@echo off
REM Build script for QR Generator (Windows)
REM This script downloads dependencies and compiles the project

REM Save current directory and change to script directory
pushd "%~dp0"

echo === QR Code Generator Build Script ===
echo.

REM Create directories
if not exist "lib" mkdir lib
if not exist "target" mkdir target
if not exist "target\classes" mkdir target\classes

echo [1/4] Downloading ZXing dependencies...

REM Download ZXing Core
if not exist "lib\core-3.5.3.jar" (
    echo Downloading zxing core...
    curl -L -o lib\core-3.5.3.jar https://repo1.maven.org/maven2/com/google/zxing/core/3.5.3/core-3.5.3.jar
    if errorlevel 1 (
        echo Error: Failed to download zxing core
        exit /b 1
    )
)

REM Download ZXing JavaSE
if not exist "lib\javase-3.5.3.jar" (
    echo Downloading zxing javase...
    curl -L -o lib\javase-3.5.3.jar https://repo1.maven.org/maven2/com/google/zxing/javase/3.5.3/javase-3.5.3.jar
    if errorlevel 1 (
        echo Error: Failed to download zxing javase
        exit /b 1
    )
)

echo.
echo [2/4] Compiling Java sources...
javac -d target\classes -cp "lib\*" src\main\java\com\qrgen\Main.java src\main\java\com\qrgen\QRCodeGenerator.java
if errorlevel 1 (
    echo Error: Compilation failed
    exit /b 1
)

echo.
echo [3/4] Creating JAR file...
cd target\classes
jar -cvf ..\qr-generator.jar com\qrgen\*.class
cd ..\..

echo.
echo [4/4] Creating run script...
echo @echo off > run.bat
echo if "%%~1"=="" ( >> run.bat
echo   echo Usage: run.bat "Your text here" [output.png] >> run.bat
echo   echo Example: run.bat "HELLO WORLD" >> run.bat
echo   exit /b 1 >> run.bat
echo ^) >> run.bat
echo java -cp "lib\*;target\qr-generator.jar" com.qrgen.Main %%* >> run.bat

echo.
echo === Build Successful! ===
echo.
echo Usage:
echo   run.bat "Your text here"

REM Restore original directory
popd
echo   run.bat "Your text here" output.png
echo.
