export interface TourStop {
  title: string;
  file: string;
  whyThisFile: string;
  whatToNotice: string[];
  nextReason: string;
}

export interface GuidedTour {
  introduction: string;
  stops: TourStop[];
}
