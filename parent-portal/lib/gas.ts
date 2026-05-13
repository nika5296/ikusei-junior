/** GAS ?format=json の返却（フィールド名・意味は GAS 側に合わせる） */
export type StudentApiPayload = {
  ok: boolean;
  error: string;
  name: string;
  remainingMain: string;
  remainingSuffix: string;
  remainingHasUnit: boolean;
  updated: string;
  reservationUrl: string;
  definitionHtml: string;
  assets: {
    logoUrl: string;
    bearLeftUrl: string;
    bearRightUrl: string;
  };
};

function gasBase(): string {
  const b = process.env.GAS_STUDENT_API_BASE_URL?.trim();
  if (!b) {
    throw new Error('環境変数 GAS_STUDENT_API_BASE_URL が未設定です（…/exec のURL）');
  }
  return b.replace(/\/+$/, '');
}

/**
 * サーバーから GAS ウェブアプリを fetch（ブラウザ直叩きではないので CORS 不要）
 */
export async function fetchStudentPayload(token: string): Promise<StudentApiPayload> {
  const url = `${gasBase()}?${new URLSearchParams({ token, format: 'json' }).toString()}`;
  const res = await fetch(url, {
    next: { revalidate: 60 },
    headers: { Accept: 'application/json' }
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GAS が ${res.status} を返しました`);
  }
  try {
    return JSON.parse(text) as StudentApiPayload;
  } catch {
    throw new Error('GAS の応答が JSON ではありません。format=json が有効か確認してください。');
  }
}
