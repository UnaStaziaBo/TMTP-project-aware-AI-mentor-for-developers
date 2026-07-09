export interface PracticeScenario {
  situation: string;
  options: string[];
  correctOption: string;
  explanation: string;
}

export interface PracticePlan {
  scenarios: PracticeScenario[];
}
