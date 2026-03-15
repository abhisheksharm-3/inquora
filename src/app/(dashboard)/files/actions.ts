"use server";

import { supabaseServerClient } from "@/data/supabase/server";
import { FILE_CONSTANTS } from "@/config/constants";

const SIGNED_URL_EXPIRES_SEC = 3600;

export async function getSignedFileUrl(fileId: string): Promise<string | null> {
    const supabase = await supabaseServerClient();
    const { data: file, error } = await supabase
        .from("files")
        .select("url")
        .eq("id", fileId)
        .single();
    if (error || !file?.url) return null;

    const url = file.url as string;
    if (!url.includes(FILE_CONSTANTS.STORAGE_BUCKET)) {
        return url;
    }
    try {
        const path = new URL(url).pathname.split(`/${FILE_CONSTANTS.STORAGE_BUCKET}/`)[1];
        if (!path) return null;
        const { data: signed } = await supabase.storage
            .from(FILE_CONSTANTS.STORAGE_BUCKET)
            .createSignedUrl(path, SIGNED_URL_EXPIRES_SEC);
        return signed?.signedUrl ?? null;
    } catch {
        return null;
    }
}
