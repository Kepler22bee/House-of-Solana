"use client"

import { useState } from "react"

interface CommitPopupProps {
  onConfirm: (amount: string) => void
  onCancel: () => void
  direction: "up" | "down"
  isPending?: boolean
}

export default function CommitPopup({ onConfirm, onCancel, direction, isPending }: CommitPopupProps) {
  const [amount, setAmount] = useState("")

  const handleConfirm = () => {
    if (amount.trim()) {
      onConfirm(amount)
      setAmount("")
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="bg-yellow-400 rounded-2xl sm:rounded-3xl p-6 sm:p-8 w-[90%] max-w-md border border-yellow-500 shadow-2xl">
        {/* Direction Indicator */}
        <div className="mb-6 text-center">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${
            direction === "up" ? "bg-green-500" : "bg-red-500"
          }`}>
            <span className="text-white text-2xl font-bold">
              {direction === "up" ? "↑" : "↓"}
            </span>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-black mb-2 text-center">
          Commit Amount
        </h2>
        <p className="text-black opacity-75 text-sm sm:text-base mb-6 text-center">
          Betting {direction === "up" ? "UP" : "DOWN"}
        </p>

        {/* Amount Input */}
        <div className="mb-6">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount..."
            className="w-full bg-yellow-500 border-2 border-yellow-600 rounded-xl px-4 py-3 text-black text-lg font-bold placeholder-black placeholder-opacity-50 focus:outline-none focus:border-black transition"
            autoFocus
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-yellow-500 text-black rounded-xl py-3 px-6 text-lg font-bold hover:bg-yellow-600 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!amount.trim() || isPending}
            className="flex-1 bg-black text-yellow-400 rounded-xl py-3 px-6 text-lg font-bold hover:bg-gray-900 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition"
          >
            {isPending ? 'Submitting...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
