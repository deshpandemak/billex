import type { Designation, FeeConfig, ResultStatus } from "@/types";

const STATUS_FEE_FIELD: Record<ResultStatus, keyof Pick<FeeConfig, "adjourned" | "heardAdjourned" | "disposed">> = {
  ADJOURNED: "adjourned",
  HEARD_ADJOURNED: "heardAdjourned",
  DISPOSED: "disposed",
};

export function computeFees(
  designation: Designation | "",
  status: ResultStatus | "",
  feeConfigByDesignation: Partial<Record<Designation, FeeConfig>>
): number {
  if (!designation || !status) return 0;
  const config = feeConfigByDesignation[designation];
  if (!config) return 0;
  return config[STATUS_FEE_FIELD[status]] ?? 0;
}
