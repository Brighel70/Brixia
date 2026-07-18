import React from 'react'
import { PersonForm } from '@/hooks/usePersonForm'

interface Tab {
  id: string
  name: string
  icon: string
  hidden?: boolean
}

interface CreatePersonTabsProps {
  tabs: Tab[]
  activeTab: string
  setActiveTab: (tab: string) => void
  form: PersonForm
}

const CreatePersonTabs: React.FC<CreatePersonTabsProps> = ({
  tabs,
  activeTab,
  setActiveTab,
  form
}) => {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-6">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs
            .filter(tab => !tab.hidden)
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span className="mr-2 text-lg">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
        </nav>
      </div>
    </div>
  )
}

export default CreatePersonTabs







