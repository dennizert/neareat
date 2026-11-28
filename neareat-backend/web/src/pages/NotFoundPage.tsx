import { Link } from 'react-router-dom';
import { EmptyState } from '../components/Feedback';

export default function NotFoundPage() {
  return (
    <div className="card">
      <EmptyState icon="alert" title="Sayfa bulunamadı" action={<Link className="btn btn-primary" to="/">Genel bakışa dön</Link>}>
        Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir.
      </EmptyState>
    </div>
  );
}
