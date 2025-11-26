@echo off 
if "%~1"=="" ( 
  echo Usage: run.bat "Your text here" [output.png] 
  echo Example: run.bat "HELLO WORLD" 
  exit /b 1 
) 
java -cp "lib\*;target\qr-generator.jar" com.qrgen.Main %* 
