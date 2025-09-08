import React from 'react'

interface AddressTabProps {
  form: any
  handleInputChange: (field: string, value: string) => void
  isFieldDisabled: () => boolean
}

const AddressTab: React.FC<AddressTabProps> = ({ 
  form, 
  handleInputChange, 
  isFieldDisabled 
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Via/Indirizzo - 2 colonne */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Via/Indirizzo
          </label>
          <input
            type="text"
            value={form.address_street}
            onChange={(e) => handleInputChange('address_street', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
            placeholder="Via, numero civico..."
          />
        </div>
        
        {/* CAP - 1 colonna */}
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            CAP
          </label>
          <input
            type="text"
            value={form.address_zip}
            onChange={(e) => handleInputChange('address_zip', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
            placeholder="25010"
            maxLength={5}
          />
        </div>
        
        {/* Paese - 1 colonna */}
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Paese
          </label>
          <input
            type="text"
            value={form.address_country}
            onChange={(e) => {
              const value = e.target.value
              const formattedValue = value
                .toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
              handleInputChange('address_country', formattedValue)
            }}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
            placeholder="Italia"
          />
        </div>
        
        {/* Città - 2 colonne */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Città
          </label>
          <input
            type="text"
            value={form.address_city}
            onChange={(e) => {
              const value = e.target.value
              const formattedValue = value
                .toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
              handleInputChange('address_city', formattedValue)
            }}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
            placeholder="Brescia"
          />
        </div>
      </div>
    </div>
  )
}

export default AddressTab


