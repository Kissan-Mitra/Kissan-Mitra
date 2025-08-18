# IAM Policies for Agricultural AI System Administrator

To create an IAM user with permissions to manage all resources in the Agricultural AI system, attach the following AWS managed policies and create the custom policies below.

## AWS Managed Policies to Attach

1. **AmazonDynamoDBFullAccess**
   - Provides full access to DynamoDB tables, indexes, streams, etc.

2. **AmazonS3FullAccess**
   - Provides full access to all S3 buckets and objects

3. **AWSLambda_FullAccess**
   - Provides full access to Lambda functions, layers, and configurations

4. **AmazonOpenSearchServiceFullAccess**
   - Provides full access to OpenSearch domains and configurations

5. **AmazonAPIGatewayAdministrator**
   - Provides permissions to create, configure and manage API Gateways

6. **CloudWatchFullAccess**
   - Provides full access to CloudWatch metrics, logs, alarms, and dashboards

7. **AWSCloudFormationFullAccess**
   - Provides permissions to create and manage CloudFormation stacks

8. **IAMFullAccess** (only if the user needs to manage service roles)
   - Provides full access to create and manage IAM roles, policies, etc.

## Custom Policy for Agricultural AI Specific Resources

In addition to the managed policies, create a custom policy for Agricultural AI specific resources:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:*"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/*-vector-database",
        "arn:aws:dynamodb:*:*:table/*-knowledge-graph",
        "arn:aws:dynamodb:*:*:table/*-time-series",
        "arn:aws:dynamodb:*:*:table/*-session"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:*"
      ],
      "Resource": [
        "arn:aws:lambda:*:*:function:*-voice-gateway",
        "arn:aws:lambda:*:*:function:*-agent-tools",
        "arn:aws:lambda:*:*:function:*-data-processing"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:*"
      ],
      "Resource": [
        "arn:aws:s3:::agricultural-ai-data-*",
        "arn:aws:s3:::agricultural-ai-data-*/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "es:*"
      ],
      "Resource": [
        "arn:aws:es:*:*:domain/agricultural-ai-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "apigateway:*"
      ],
      "Resource": [
        "arn:aws:apigateway:*::/restapis/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:*"
      ],
      "Resource": [
        "arn:aws:logs:*:*:log-group:/aws/lambda/*-voice-gateway:*",
        "arn:aws:logs:*:*:log-group:/aws/lambda/*-agent-tools:*",
        "arn:aws:logs:*:*:log-group:/aws/lambda/*-data-processing:*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "events:*"
      ],
      "Resource": [
        "arn:aws:events:*:*:rule/*-daily-data-processing"
      ]
    }
  ]
}
```

## Security Considerations

For production environments, it's recommended to:

1. **Apply the principle of least privilege**
   - Instead of using the full access policies, create more restrictive policies based on the actual operations the user needs to perform.

2. **Consider using separate users for different environments**
   - Create different IAM users for dev, test, and production environments.

3. **Implement resource naming conventions**
   - Use resource naming patterns (like including the environment name) to limit access to specific environments.

4. **Enable MFA**
   - Enforce Multi-Factor Authentication for the IAM user.

5. **Regularly rotate credentials**
   - Set up a schedule to rotate the IAM user's access keys.

## CloudFormation Deployment

If you're using CloudFormation to deploy the infrastructure, you can create a more limited policy that only allows:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:DescribeStackResource",
        "cloudformation:DescribeStackResources",
        "cloudformation:ListStackResources"
      ],
      "Resource": [
        "arn:aws:cloudformation:*:*:stack/agricultural-ai-*/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": [
        "arn:aws:iam::*:role/agricultural-ai-*-lambda-role"
      ]
    }
  ]
}
```
