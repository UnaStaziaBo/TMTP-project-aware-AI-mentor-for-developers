export interface KeyConstruct {
  snippet: string;
  project: string;
  language: string;
  architecture: string;
}

export interface FileLesson {
  file: string;
  title: string;
  responsibility: string;
  keyConstructs: KeyConstruct[];
}
