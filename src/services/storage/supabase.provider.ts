"use client";
import { createClient } from "@/lib/supabase/client";
import type { IStorageProvider, UploadParams } from "./types";

const BUCKET = "documentos";

export class SupabaseStorageProvider implements IStorageProvider {
  private supabase = createClient();

  async upload({ file, path }: UploadParams): Promise<string> {
    const { error } = await this.supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  }

  async getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  }

  async delete(path: string): Promise<void> {
    const { error } = await this.supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;
  }
}
