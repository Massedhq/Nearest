import Image from "next/image";
import { RepAgreementText } from "@/components/RepAgreementText";

export const metadata = { title: "Sales Ambassador Agreement" };

export default function RepAgreementPage() {
  return (
    <div className="scr">
      <div className="body" style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
        <Image src="/brand/nearest-monogram.png" alt="Nearest" width={48} height={48} />
        <RepAgreementText />
      </div>
    </div>
  );
}
