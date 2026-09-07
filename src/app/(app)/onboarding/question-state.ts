export function visibleChoiceValue<T extends string>(
  value: T,
  questionStep: number,
  lastCompletedStep: number
): T | "" {
  return lastCompletedStep >= questionStep ? value : "";
}
