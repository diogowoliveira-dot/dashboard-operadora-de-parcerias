import './globals.css'

export const metadata = {
  title: 'DWV — Painel da Operadora',
  description: 'Central de inteligência para operadoras de parcerias DWV',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
