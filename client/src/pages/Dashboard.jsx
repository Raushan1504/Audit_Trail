import { useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
function Dashboard() {
  const navigate = useNavigate();

  const handleSearch = (shipmentId) => {
    navigate(`/shipment/${shipmentId}`);
  };

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1>Audit Trail — Forensic Dashboard</h1>
        <p>Search a shipment to view its event history and current state.</p>
      </header>

      <SearchBar onSearch={handleSearch} />
    </div>
  );
}

export default Dashboard;