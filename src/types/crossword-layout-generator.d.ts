declare module "crossword-layout-generator" {
  export interface InputWord {
    clue: string;
    answer: string;
  }

  export interface ResultWord {
    clue: string;
    answer: string;
    startx?: number;
    starty?: number;
    orientation: "across" | "down" | "none";
    position?: number;
  }

  export interface Layout {
    table: string[][];
    result: ResultWord[];
    rows: number;
    cols: number;
    table_string: string;
  }

  export function generateLayout(words: InputWord[]): Layout;
}
