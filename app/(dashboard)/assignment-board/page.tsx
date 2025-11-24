import AssignmentBoard from "@/components/assignment-board"

export default function AssignmentBoardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff Assignment Board</h1>
        <p className="text-gray-600 mt-1">
          Assign providers to shifts across hospitals and services
        </p>
      </div>

      {/* Assignment Board */}
      <AssignmentBoard />
    </div>
  )
}
