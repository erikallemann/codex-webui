"use client";

/**
 * EventCard — 按 item.type 分发到对应卡片组件。
 */

import type { FileChangeItem, ResponseItem } from "@/types/api";
import { AgentMessageCard } from "./AgentMessageCard";
import { ReasoningCard } from "./ReasoningCard";
import { CommandExecutionCard } from "./CommandExecutionCard";
import { FileChangeCard } from "./FileChangeCard";
import { McpToolCallCard } from "./McpToolCallCard";
import { WebSearchCard } from "./WebSearchCard";
import { PlanUpdateCard } from "./PlanUpdateCard";
import { UserMessageCard } from "./UserMessageCard";
import { ErrorCard } from "./ErrorCard";

interface EventCardProps {
  item: ResponseItem;
  onOpenDiff: (item: FileChangeItem) => void;
  /** item 时间戳（ISO 字符串） */
  timestamp?: string;
  /** 是否显示头像+名字（仅每轮首个 agent_message 为 true，子回复为 false） */
  showHeader?: boolean;
}

export function EventCard({ item, onOpenDiff, timestamp, showHeader }: EventCardProps) {
  switch (item.type) {
    case "agent_message":
      return <AgentMessageCard item={item} timestamp={timestamp} showHeader={showHeader} />;
    case "reasoning":
      return <ReasoningCard item={item} timestamp={timestamp} />;
    case "command_execution":
      return <CommandExecutionCard item={item} />;
    case "file_change":
      return <FileChangeCard item={item} onOpenDiff={onOpenDiff} />;
    case "mcp_tool_call":
      return <McpToolCallCard item={item} />;
    case "web_search":
      return <WebSearchCard item={item} />;
    case "plan_update":
      return <PlanUpdateCard item={item} />;
    case "user_message":
      return <UserMessageCard item={item} timestamp={timestamp} />;
    case "error":
      return <ErrorCard item={item} />;
    default:
      return null;
  }
}
