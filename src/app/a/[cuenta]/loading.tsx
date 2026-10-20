import { BrandLoader } from '@/components/ui/brand-loader';

// Lo que se ve apenas se toca otra pantalla, mientras el servidor la arma: el
// menú queda y en el centro late el logo. Con esto Next también puede
// adelantar esta parte antes del toque.

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <BrandLoader />
    </div>
  );
}
