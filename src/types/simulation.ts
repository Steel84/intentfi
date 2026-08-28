/**
 * Simulation / Preflight Types
 */

export type SimulationResult = {
  success: boolean;
  gasUsed?: string;
  error?: string;
  balanceCheck: boolean;
  allowanceCheck: boolean;
  details?: string;
};
