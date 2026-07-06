import { INotification, ChannelType } from '../models';

/**
 * Interface for notification channel implementations
 * Defines the contract for sending notifications through different channels
 */
export interface INotificationChannel {
  /**
   * Send a notification through this channel
   * @param notification - The notification to send
   * @param user - The recipient user object
   * @returns Promise<boolean> - True if sent successfully, false otherwise
   */
  send(notification: INotification, user: any): Promise<boolean>;

  /**
   * Check if this channel can send to the specified user
   * @param user - The recipient user object
   * @returns Promise<boolean> - True if can send, false otherwise
   */
  canSend(user: any): Promise<boolean>;

  /**
   * Retry sending a failed notification
   * @param notification - The notification to retry
   * @param channelType - The channel type for this retry attempt
   * @returns Promise<boolean> - True if retry was successful, false otherwise
   */
  retry(notification: INotification, channelType: ChannelType): Promise<boolean>;
}