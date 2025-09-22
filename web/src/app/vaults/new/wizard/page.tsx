import { redirect } from "next/navigation";

export default function WizardIndexRedirect() {
  redirect("/vaults/new/wizard/step-1");
}
