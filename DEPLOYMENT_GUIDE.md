# QR Code Generator - AWS Lambda Deployment Guide

## Quick Start

You're deploying your hand-written Java QR code generator to AWS Lambda. **No Docker needed** - just upload a JAR file.

---

## Prerequisites

### 1. Install Maven (Build Tool)

```bash
# macOS (Homebrew)
brew install maven

# Verify installation
mvn --version
```

### 2. AWS Account Setup

- Create free AWS account: https://aws.amazon.com/free
- Install AWS CLI: `brew install awscli`
- Configure AWS CLI: `aws configure`

### 3. Java 17+ Installed

```bash
# Check Java version
java -version

# If not installed (macOS):
brew install openjdk@17
```

---

## Step 1: Build the Lambda JAR

```bash
cd apps/qr-generator
mvn clean package
```

**Expected output**: `target/qr-generator-lambda.jar` (2-3 MB)

Verify:
```bash
ls -lh target/qr-generator-lambda.jar
```

---

## Step 2: Create IAM Role (AWS Console Method)

### Why needed?
Lambda needs permission to write logs to CloudWatch.

### Steps:
1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Click **Roles** → **Create role**
3. Select **AWS service** → **Lambda**
4. Attach policy: `AWSLambdaBasicExecutionRole`
5. Role name: `qr-generator-lambda-role`
6. Click **Create role**
7. **Copy the Role ARN** (looks like `arn:aws:iam::123456789012:role/qr-generator-lambda-role`)

### Alternative: CLI Method

```bash
aws iam create-role \
  --role-name qr-generator-lambda-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name qr-generator-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

---

## Step 3: Deploy Lambda Function (AWS Console Method)

1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda/)
2. Click **Create function**
3. Select **Author from scratch**
4. Configuration:
   - **Function name**: `qr-generator`
   - **Runtime**: `Java 17` (or Java 21)
   - **Architecture**: `x86_64`
   - **Permissions**: Use existing role `qr-generator-lambda-role`
5. Click **Create function**

### Upload JAR

1. In your Lambda function page, scroll to **Code source**
2. Click **Upload from** → **.zip or .jar file**
3. Select `apps/qr-generator/target/qr-generator-lambda.jar`
4. Click **Save**

### Configure Handler

1. Click **Runtime settings** → **Edit**
2. **Handler**: `com.qrgen.LambdaHandler::handleRequest`
3. Click **Save**

### Increase Memory and Timeout

1. Click **Configuration** → **General configuration** → **Edit**
2. **Memory**: `512 MB` (faster cold starts)
3. **Timeout**: `30 seconds`
4. Click **Save**

### Alternative: CLI Deployment

```bash
aws lambda create-function \
  --function-name qr-generator \
  --runtime java17 \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/qr-generator-lambda-role \
  --handler com.qrgen.LambdaHandler::handleRequest \
  --zip-file fileb://target/qr-generator-lambda.jar \
  --memory-size 512 \
  --timeout 30
```

---

## Step 4: Test Lambda Function

### Via AWS Console

1. Go to your Lambda function
2. Click **Test** tab
3. Click **Create new event**
4. Event name: `test-qr`
5. Event JSON:
```json
{
  "body": "{\"text\":\"https://example.com\"}"
}
```
6. Click **Test**

### Expected Response

```json
{
  "statusCode": 200,
  "body": "{\"success\":true,\"dataUrl\":\"data:image/png;base64,iVBORw0KG...\",\"version\":2,\"mode\":\"BYTE\"}",
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  }
}
```

### Via CLI

```bash
cd apps/qr-generator

aws lambda invoke \
  --function-name qr-generator \
  --payload '{"httpMethod": "POST", "body": "{\"text\":\"https://example.com\"}"}' \
  response.json

cat response.json
```

---

## Step 5: Create API Gateway (HTTP API)

### Why HTTP API?
71% cheaper than REST API, simpler for basic Lambda integration.

### Via AWS Console

1. Go to [API Gateway Console](https://console.aws.amazon.com/apigateway/)
2. Click **Create API**
3. Select **HTTP API** → **Build**
4. **Add integration**:
   - Type: **Lambda**
   - Region: Select your region (e.g., us-east-1)
   - Lambda function: `qr-generator`
5. API name: `qr-generator-api`
6. Click **Next**
7. **Configure routes**:
   - Method: `POST`
   - Resource path: `/generate`
   - Integration target: `qr-generator`
8. Click **Next** → **Next** → **Create**
9. **Copy your Invoke URL** (looks like `https://abc123.execute-api.us-east-1.amazonaws.com`)

### Via CLI

```bash
# Create HTTP API with Lambda integration
aws apigatewayv2 create-api \
  --name qr-generator-api \
  --protocol-type HTTP \
  --target arn:aws:lambda:REGION:ACCOUNT_ID:function:qr-generator

# Note the API endpoint URL from output
```

---

## Step 6: Test API Gateway Endpoint

```bash
curl -X POST https://YOUR_API_URL/generate \
  -H "Content-Type: application/json" \
  -d '{"text":"https://example.com"}'
```

**Expected response**:
```json
{
  "success": true,
  "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "version": 2,
  "mode": "BYTE",
  "size": 19
}
```

---

## Step 7: Integrate with Cloudflare Workers

### Update Environment Variable

**Option A: Add to wrangler.toml** (less secure, easier)

Edit `apps/api/wrangler.toml`:
```toml
[vars]
PUBLIC_BASE_URL = "https://b.ularkimsanov.com"
QR_SERVICE_URL = "https://YOUR_API_GATEWAY_URL/generate"
```

**Option B: Use Wrangler Secret** (more secure, recommended)

```bash
cd apps/api
echo "https://YOUR_API_GATEWAY_URL/generate" | npx wrangler secret put QR_SERVICE_URL
```

### Deploy Updated Worker

```bash
cd apps/api
npx wrangler deploy
```

---

## Step 8: Test End-to-End

Create a short URL and verify QR code generation:

```bash
curl -X POST https://b.ularkimsanov.com/api/shorten \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://github.com",
    "expiresInHours": 24
  }'
```

**Expected response**:
```json
{
  "shortUrl": "https://b.ularkimsanov.com/abc123",
  "shortCode": "abc123",
  "longUrl": "https://github.com",
  "expiresAt": "2025-11-26T12:00:00Z",
  "qrCode": {
    "status": "ready",
    "url": "data:image/png;base64,iVBORw0KGg..."
  }
}
```

Copy the `qrCode.url` value and paste it in your browser address bar - you should see the QR code image!

---

## Cost Analysis (Free Tier)

### AWS Lambda
- **Requests**: 1M/month FREE forever
- **Compute**: 400,000 GB-seconds/month FREE
- Your usage (512MB, 500ms avg): 250,000 GB-seconds
- ✅ **Well within free tier**

### Cloudflare Workers
- **Requests**: 100,000/day (3M/month) FREE
- ✅ **Well within free tier**

### Total Cost: $0/month
For 100K QR generations/month, you stay completely free.

---

## Performance Expectations

- **Cold start** (first request): 500-800ms (~1% of requests)
- **Warm requests**: 100-200ms generation + 50-100ms network = ~250-350ms total
- **Very acceptable** for side project

---

## Troubleshooting

### "mvn: command not found"
**Solution**: Install Maven
```bash
brew install maven
mvn --version
```

### Lambda "Task timed out after 30 seconds"
**Solution**: Increase Lambda memory to 1024 MB (faster CPU)

### API Gateway "Malformed Lambda proxy response"
**Solution**: Check Lambda CloudWatch logs. Ensure LambdaHandler returns correct format.

### Worker "fetch failed"
**Solution**:
1. Verify API Gateway URL is correct
2. Check Lambda CloudWatch logs for errors
3. Ensure Lambda has correct handler: `com.qrgen.LambdaHandler::handleRequest`

### "Class not found: com.qrgen.LambdaHandler"
**Solution**:
```bash
# Rebuild JAR
cd apps/qr-generator
mvn clean package

# Re-upload to Lambda
```

### QR code not displaying in browser
**Solution**:
1. Copy the `dataUrl` value from response
2. Paste directly in browser address bar (should start with `data:image/png;base64,`)
3. If doesn't work, check Lambda response format

---

## Deployment Checklist

- [ ] Install Maven: `brew install maven`
- [ ] Build JAR: `cd apps/qr-generator && mvn clean package`
- [ ] Create IAM role in AWS Console
- [ ] Deploy Lambda function (upload JAR)
- [ ] Configure Lambda handler: `com.qrgen.LambdaHandler::handleRequest`
- [ ] Test Lambda with sample payload
- [ ] Create API Gateway HTTP API
- [ ] Test API Gateway endpoint with curl
- [ ] Update `wrangler.toml` with `QR_SERVICE_URL`
- [ ] Deploy Cloudflare Worker: `cd apps/api && npx wrangler deploy`
- [ ] Test end-to-end (create short URL, verify QR code)
- [ ] 🎉 Celebrate - your hand-written Java code is in production!

---

## Monitoring (Optional)

View Lambda logs:
1. Go to your Lambda function
2. Click **Monitor** → **View CloudWatch logs**
3. See execution logs, errors, performance metrics

---

## Next Steps After Deployment

1. ✅ **Remove debug logging** from `apps/api/src/index.ts` (all `console.log` statements)
2. 🚀 **Add Cloudflare R2 storage** (optional - cache QR codes for faster delivery)
3. 📊 **Add monitoring** - CloudWatch alarms for Lambda errors
4. 🔒 **Add rate limiting** in Worker to prevent abuse

---

## Support

If you get stuck:
1. Check CloudWatch logs in AWS Lambda
2. Check Wrangler logs: `cd apps/api && npx wrangler tail`
3. Verify all environment variables are set correctly

---

**Architecture Summary**:
```
User Request
  → Cloudflare Worker (Edge - 300+ locations)
    → AWS Lambda (Java QR Generator - your hand-written code!)
      → Returns base64 PNG data URL
        → Stored in database
          → Delivered to user
```

**Your team's Java code is now running in production on AWS Lambda!** 🎉
