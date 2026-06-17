/**
 * 推送通道 SPI 契约 —— INotificationChannel。
 * 见 doc/design-doc/05-可插拔SPI设计.md §5.2。
 *
 * 默认实现：ConsoleNotifier（打印）。内网扩展：Email/企微/飞书/钉钉/Telegram，
 * registerNotifier 注册即用，核心 delivery 代码零改动。
 */

/** 推送载荷（交付给通道的统一结构）。 */
export interface NotificationPayload {
  userId: string;
  userName: string;
  reportId: string;
  issueNo: string;
  /** 标题 */
  subject: string;
  /** 摘要 */
  summary: string;
  /** 站内报告链接 */
  reportUrl: string;
  /** 完整报告数据（通道按需取） */
  reportDeepJson: unknown;
  meta?: Record<string, unknown>;
}

/** 推送结果。 */
export interface NotificationResult {
  ok: boolean;
  error?: string;
}

/** 推送通道接口。 */
export interface INotificationChannel {
  /** 通道标识，与 NotificationChannelType 对应。 */
  readonly channel: string;
  send(p: NotificationPayload): Promise<NotificationResult>;
}
