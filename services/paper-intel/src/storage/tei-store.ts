export type TeiXml = string;

export type TeiStore = {
  saveTei(projectId: string, paperId: string, tei: TeiXml): Promise<void>;
  loadTei(projectId: string, paperId: string): Promise<TeiXml | null>;
};
