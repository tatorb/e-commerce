'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { actAsAdmin } from '@/lib/auth/guard';
import { addBrand, BrandError, removeBrand, updateBrand } from '@/lib/text-images/brands';

// La base de marcas de vehículos: es la misma para todas las cuentas, así que
// solo la cambia un administrador. Los logos se suben aparte (api/marcas-vehiculos).

type Result = { ok: true; message: string } | { ok: false; error: string };

async function guard(run: () => Promise<string>): Promise<Result> {
  try {
    const message = await run();
    revalidatePath('/marcas-vehiculos');
    return { ok: true, message };
  } catch (e) {
    if (e instanceof BrandError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function addBrandAction(input: { name: string; aliases: string }): Promise<Result> {
  return actAsAdmin({ does: 'Agregó una marca de vehículos', targetLabel: String(input?.name ?? '') }, () =>
    guard(async () => {
      await addBrand(prisma, { name: String(input?.name ?? ''), aliases: String(input?.aliases ?? '') });
      return 'Marca agregada. Ya podés subirle el logo.';
    }),
  );
}

export async function updateBrandAction(key: string, input: { name: string; aliases: string }): Promise<Result> {
  return actAsAdmin({ does: 'Editó una marca de vehículos', targetLabel: String(key) }, () =>
    guard(async () => {
      await updateBrand(prisma, String(key), { name: String(input?.name ?? ''), aliases: String(input?.aliases ?? '') });
      return 'Guardado.';
    }),
  );
}

export async function removeBrandAction(key: string): Promise<Result> {
  return actAsAdmin({ does: 'Borró una marca de vehículos', targetLabel: String(key) }, () =>
    guard(async () => {
      await removeBrand(prisma, String(key));
      return 'Marca borrada.';
    }),
  );
}
