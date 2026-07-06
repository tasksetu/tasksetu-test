/**
 * Base exception class for notification channel errors
 */
class NotificationChannelException extends Error {
  public readonly channelType?: string;
  public readonly notificationId?: string;

  constructor(
    message: string, 
    channelType?: string, 
    notificationId?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'NotificationChannelException';
    this.channelType = channelType;
    this.notificationId = notificationId;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NotificationChannelException);
    }
  }
}

/**
 * Exception thrown when channel configuration is invalid or missing
 */
class ChannelConfigurationException extends NotificationChannelException {
  constructor(
    message: string,
    channelType?: string,
    public readonly configField?: string,
    cause?: Error
  ) {
    super(message, channelType, undefined, cause);
    this.name = 'ChannelConfigurationException';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ChannelConfigurationException);
    }
  }
}

/**
 * Exception thrown when sending notification through a channel fails
 */
class ChannelSendFailedException extends NotificationChannelException {
  public readonly retryCount?: number;
  public readonly maxRetries?: number;

  constructor(
    message: string,
    channelType?: string,
    notificationId?: string,
    retryCount?: number,
    maxRetries?: number,
    cause?: Error
  ) {
    super(message, channelType, notificationId, cause);
    this.name = 'ChannelSendFailedException';
    this.retryCount = retryCount;
    this.maxRetries = maxRetries;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ChannelSendFailedException);
    }
  }

  /**
   * Check if this exception represents a retryable failure
   * @returns True if the failure can be retried
   */
  isRetryable(): boolean {
    return this.retryCount !== undefined && 
           this.maxRetries !== undefined && 
           this.retryCount < this.maxRetries;
  }
}

export {
  NotificationChannelException,
  ChannelConfigurationException,
  ChannelSendFailedException
};