import Badge from "@/components/ui/Badge";
import { STATUS_MEDICAO_LABEL, STATUS_MEDICAO_COR } from "@/constants/dominios";
import type { StatusMedicao } from "@/types/app.types";

export default function StatusBadgeMedicao({ status }: { status: StatusMedicao }) {
  return (
    <Badge color={STATUS_MEDICAO_COR[status]}>
      {STATUS_MEDICAO_LABEL[status]}
    </Badge>
  );
}
