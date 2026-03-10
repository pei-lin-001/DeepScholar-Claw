import { isResearchStep, type ResearchStep } from "@deepscholar/contracts";

export type BotTemplate = {
  readonly templateId: string;
  readonly displayName: string;
  readonly mission: string;
  readonly allowedSteps: readonly ResearchStep[];
};

export type BotTemplateRegistry = {
  register: (template: BotTemplate) => void;
  get: (templateId: string) => BotTemplate;
  list: () => BotTemplate[];
};

function requireNonEmptyText(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} 必须是字符串`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} 不能为空`);
  }
  return trimmed;
}

function requireAllowedSteps(steps: readonly ResearchStep[]): readonly ResearchStep[] {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("allowedSteps 至少需要包含一个步骤");
  }
  for (const step of steps) {
    if (typeof step !== "string" || !isResearchStep(step)) {
      throw new Error(`allowedSteps 包含非法步骤: ${String(step)}`);
    }
  }
  return steps;
}

function normalizeTemplate(template: BotTemplate): BotTemplate {
  return {
    templateId: requireNonEmptyText(template.templateId, "templateId"),
    displayName: requireNonEmptyText(template.displayName, "displayName"),
    mission: requireNonEmptyText(template.mission, "mission"),
    allowedSteps: requireAllowedSteps(template.allowedSteps),
  };
}

export function createInMemoryBotTemplateRegistry(
  initialTemplates: readonly BotTemplate[] = [],
): BotTemplateRegistry {
  const templates = new Map<string, BotTemplate>();
  for (const template of initialTemplates) {
    const normalized = normalizeTemplate(template);
    templates.set(normalized.templateId, normalized);
  }

  function register(template: BotTemplate): void {
    const normalized = normalizeTemplate(template);
    if (templates.has(normalized.templateId)) {
      throw new Error(`Bot 模板已存在: ${normalized.templateId}`);
    }
    templates.set(normalized.templateId, normalized);
  }

  function get(templateId: string): BotTemplate {
    const id = requireNonEmptyText(templateId, "templateId");
    const template = templates.get(id);
    if (!template) {
      throw new Error(`找不到 Bot 模板: ${id}`);
    }
    return template;
  }

  function list(): BotTemplate[] {
    return Array.from(templates.values());
  }

  return { register, get, list };
}
