import { useState } from 'react';
import './SearchBar.css';

function SearchBar({ onSearch }) {
  const [shipmentId, setShipmentId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (shipmentId.trim() === '') return;
    onSearch(shipmentId.trim());
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Enter Shipment / Container ID..."
        value={shipmentId}
        onChange={(e) => setShipmentId(e.target.value)}
        className="search-bar__input"
      />
      <button type="submit" className="search-bar__button">
        Search
      </button>
    </form>
  );
}

export default SearchBar;