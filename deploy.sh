#!/bin/bash
# Deployment script for Agricultural AI System

set -e  # Exit on error

# Default values
STACK_NAME="agricultural-ai-dev"
ENVIRONMENT="dev"
BUCKET_PREFIX="agricultural-ai-data"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --bucket-prefix)
      BUCKET_PREFIX="$2"
      shift 2
      ;;
    --stack-name)
      STACK_NAME="$2"
      shift 2
      ;;
    --help)
      echo "Usage: ./deploy.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --env ENV              Deployment environment (dev, test, prod). Default: dev"
      echo "  --bucket-prefix PREFIX S3 bucket name prefix. Default: agricultural-ai-data"
      echo "  --stack-name NAME      CloudFormation stack name. Default: agricultural-ai-dev"
      echo "  --help                 Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}===== Agricultural AI System Deployment =====${NC}"
echo -e "${BLUE}Environment:${NC} $ENVIRONMENT"
echo -e "${BLUE}Stack Name:${NC} $STACK_NAME"
echo -e "${BLUE}Bucket Prefix:${NC} $BUCKET_PREFIX"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
  echo -e "${RED}Error: AWS CLI is not installed. Please install it first.${NC}"
  exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
  echo -e "${RED}Error: AWS credentials not configured. Please run 'aws configure' first.${NC}"
  exit 1
fi

# Ask for OpenAI API Key if not provided as environment variable
if [ -z "$OPENAI_API_KEY" ]; then
  echo -e "${YELLOW}Enter your OpenAI API Key:${NC}"
  read -s OPENAI_API_KEY
  echo ""
fi

# We'll manually upload data to S3 instead of using external API services

echo -e "${GREEN}Deploying CloudFormation stack...${NC}"

# Deploy the CloudFormation stack
aws cloudformation deploy \
  --template-file cloudformation/agricultural-ai-resources.yml \
  --stack-name $STACK_NAME \
  --parameter-overrides \
    Environment=$ENVIRONMENT \
    BucketNamePrefix=$BUCKET_PREFIX \
    OpenAIApiKey=$OPENAI_API_KEY \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset

echo -e "${GREEN}Stack deployed successfully!${NC}"
echo ""

# Get and display stack outputs
echo -e "${BLUE}===== Stack Outputs =====${NC}"
aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}" \
  --output table

echo ""
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Upload initial data to the S3 bucket"
echo "2. Invoke the data processing Lambda function to process the data"
echo "3. Test the API Gateway endpoints"
echo ""
echo -e "${BLUE}Sample commands:${NC}"

# Get the S3 bucket name from stack outputs
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='DataBucketName'].OutputValue" \
  --output text)

# Get API Gateway URL from stack outputs
API_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayURL'].OutputValue" \
  --output text)

echo "# Upload sample data to S3"
echo "aws s3 cp sample-data/weather.json s3://$BUCKET_NAME/raw/weather/maharashtra/$(date +%Y-%m-%d).json"
echo ""
echo "# Invoke data processing Lambda"
echo "aws lambda invoke --function-name $ENVIRONMENT-data-processing --payload '{\"operation\":\"process_daily_data\"}' response.json"
echo ""
echo "# Test API Gateway"
echo "curl -X POST \"$API_URL/voice/voice-session\" -H \"Content-Type: application/json\" -d '{\"language\": \"en-IN\"}'"
