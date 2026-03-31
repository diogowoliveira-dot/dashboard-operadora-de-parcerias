const SPARKPOST_URL = 'https://api.sparkpost.com/api/v1/transmissions';
const FROM_EMAIL = 'noreply@mail.dwvapp.com.br';
const FROM_NAME = 'DWV Parcerias';

export async function sendEmail({ to, subject, html }) {
  const res = await fetch(SPARKPOST_URL, {
    method: 'POST',
    headers: {
      'Authorization': process.env.SPARKPOST_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipients: [{ address: { email: to } }],
      content: {
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        html,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`SparkPost error ${res.status}: ${JSON.stringify(err?.errors)}`);
  }

  return res.json();
}
