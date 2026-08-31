import { useState } from 'react';
import './SearchBar.css';

function SearchBar({ onSearch }) {
  const [shipmentId, setShipmentId] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setShipmentId(e.target.value);
    if (error) setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedId = shipmentId.trim();

    if (trimmedId === '') {
      setError('Please enter a Shipment or Container ID.');
      return;
    }

    setError('');
    onSearch(trimmedId);
  };

  const handleClear = () => {
    setShipmentId('');
    setError('');
  };

  return (
    <form className="search-bar-wrapper" onSubmit={handleSubmit}>
      <div className="search-bar">
        <input
          type="text"
          placeholder="Enter Shipment / Container ID..."
          value={shipmentId}
          onChange={handleChange}
          className={`search-bar__input ${error ? 'search-bar__input--error' : ''}`}
        />

        {shipmentId && (
          <button
            type="button"
            className="search-bar__clear"
            onClick={handleClear}
            aria-label="Clear search"
          >
            ×
          </button>
        )}

        <button
          type="submit"
          className="search-bar__button"
          disabled={shipmentId.trim() === ''}
        >
          Search
        </button>
      </div>

      {error && <p className="search-bar__error">{error}</p>}
    </form>
  );
}

export default SearchBar;