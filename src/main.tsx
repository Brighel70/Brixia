import React from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { router } from './routes'
import { initBrandConfig } from '@/config/brand'
import { PageTitleProvider } from '@/context/PageTitleContext'
import { CreatePersonNavProvider } from '@/context/CreatePersonNavContext'
import '@/styles/index.css'

async function bootstrap() {
  await initBrandConfig()
  createRoot(document.getElementById('root')!).render(
    <PageTitleProvider>
      <CreatePersonNavProvider>
        <RouterProvider 
        router={router} 
        future={{
          v7_startTransition: true
        }}
      />
        <Toaster position="top-right" richColors closeButton />
      </CreatePersonNavProvider>
    </PageTitleProvider>
  )
}

bootstrap()