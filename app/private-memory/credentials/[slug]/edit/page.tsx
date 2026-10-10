"use client";
import { useParams } from "next/navigation";
import CredentialEditor from "@/app/credential-editor";

export default function EditCredentialPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : undefined;
  return <CredentialEditor slug={slug} />;
}
