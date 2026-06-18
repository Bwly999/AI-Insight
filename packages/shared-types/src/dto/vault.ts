/**
 * Vault（沉淀库）DTO。
 * Phase 1C 使用，1B 先定义类型。
 * 见 dev-spec 1B.2，附录 A.17。
 */

export interface VaultEntryView {
  id: number;
  title: string;
  bodyMd: string;
  tags: string[];
  sourceSessionId: number | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}
