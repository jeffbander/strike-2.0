"use client"

import { useState, useEffect, useCallback } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  Building,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  ChevronDown,
  ChevronRightIcon,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type {
  AssignmentBoardData,
  BoardHospital,
  BoardShift,
  BoardProvider,
  MatchType,
} from "@/types/assignment-board"

interface MatchResult {
  provider: {
    id: string
    name: string
    email: string
    job_type_name: string
    job_type_code: string
    home_department_name: string
    home_hospital_name: string
    skills: string[]
    can_work_at_hospitals: string[]
  }
  matchQuality: 'Perfect' | 'Good' | 'Partial'
  score: number
  missingSkills: string[]
  extraSkills: string[]
  reasons: string[]
}

export default function AssignmentBoard() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedShift, setSelectedShift] = useState<BoardShift | null>(null)
  const [expandedHospitals, setExpandedHospitals] = useState<string[]>([])
  const [expandedServices, setExpandedServices] = useState<string[]>([])

  // Data state
  const [boardData, setBoardData] = useState<AssignmentBoardData | null>(null)
  const [providers, setProviders] = useState<BoardProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [matchLoading, setMatchLoading] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)

  // Format date for display
  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // Navigate date
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
    setSelectedDate(newDate)
  }

  // Fetch board data
  const fetchBoardData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/assignment-board')
      const data = await res.json()
      if (data.success) {
        setBoardData(data.data)
        // Auto-expand first hospital if exists
        if (data.data.hospitals.length > 0) {
          setExpandedHospitals([data.data.hospitals[0].id])
          if (data.data.hospitals[0].services.length > 0) {
            setExpandedServices([data.data.hospitals[0].services[0].id])
          }
        }
      }
    } catch (error) {
      console.error('Error fetching board data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBoardData()
  }, [fetchBoardData])

  // Find matches for selected shift
  const findMatches = async (shift: BoardShift) => {
    setSelectedShift(shift)
    setMatchLoading(true)
    setProviders([])

    try {
      const res = await fetch(`/api/matching?job_position_id=${shift.jobPositionId}`)
      const data = await res.json()
      if (data.success) {
        // Transform match results to BoardProvider format
        const transformedProviders: BoardProvider[] = data.matches.map((match: MatchResult) => ({
          id: match.provider.id,
          name: match.provider.name,
          jobCode: match.provider.job_type_code,
          department: match.provider.home_department_name,
          hospital: match.provider.home_hospital_name,
          skills: match.provider.skills,
          missingSkills: match.missingSkills.length > 0 ? match.missingSkills : undefined,
          matchType: match.matchQuality as MatchType,
          score: match.score,
        }))
        setProviders(transformedProviders)
      }
    } catch (error) {
      console.error('Error finding matches:', error)
    } finally {
      setMatchLoading(false)
    }
  }

  // Assign provider to shift
  const assignProvider = async (providerId: string) => {
    if (!selectedShift) return
    setAssigning(providerId)

    try {
      const csrfRes = await fetch('/api/csrf')
      const { csrfToken } = await csrfRes.json()

      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          job_position_id: selectedShift.jobPositionId,
          provider_id: providerId,
        }),
      })

      const data = await res.json()
      if (data.success) {
        // Refresh data
        fetchBoardData()
        setSelectedShift(null)
        setProviders([])
      } else {
        alert(data.error || 'Failed to assign provider')
      }
    } catch (error) {
      console.error('Error assigning provider:', error)
      alert('An error occurred')
    } finally {
      setAssigning(null)
    }
  }

  const toggleHospital = (id: string) => {
    setExpandedHospitals((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]
    )
  }

  const toggleService = (id: string) => {
    setExpandedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const stats = boardData?.stats || {
    totalPositions: 0,
    openPositions: 0,
    assignedPositions: 0,
    pendingPositions: 0,
    coveragePercent: 0,
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
      {/* Top Bar */}
      <header className="flex-none bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-white hover:shadow-sm"
              onClick={() => navigateDate('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 px-3 font-medium text-sm min-w-[200px] justify-center">
              <Calendar className="h-4 w-4 text-gray-500" />
              {formatDisplayDate(selectedDate)}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-white hover:shadow-sm"
              onClick={() => navigateDate('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" className="w-40 justify-between text-sm">
            All Shifts
            <Filter className="h-3 w-3 opacity-50" />
          </Button>
        </div>

        <div className="flex items-center gap-4 text-sm font-medium">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-full border border-red-100">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            {stats.openPositions} Open
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-100">
            <CheckCircle2 className="h-4 w-4" />
            {stats.assignedPositions} Assigned
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
            <span className="font-bold">{stats.coveragePercent}%</span> Coverage
          </div>
        </div>
      </header>

      {/* Main Content Split Panel */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left Panel - Tree */}
        <div className="w-full md:w-[40%] flex flex-col border-b md:border-b-0 md:border-r bg-white h-1/2 md:h-full">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !boardData?.hospitals.length ? (
                <div className="text-center py-12 text-gray-500">
                  <Building className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No hospitals found</p>
                  <p className="text-sm mt-1">Create services with shifts to see them here</p>
                </div>
              ) : (
                boardData.hospitals.map((hospital) => (
                  <HospitalNode
                    key={hospital.id}
                    hospital={hospital}
                    isExpanded={expandedHospitals.includes(hospital.id)}
                    expandedServices={expandedServices}
                    selectedShiftId={selectedShift?.id}
                    onToggleHospital={toggleHospital}
                    onToggleService={toggleService}
                    onSelectShift={findMatches}
                  />
                ))
              )}
            </div>
          </ScrollArea>

          {/* Sticky Selection Detail Card */}
          {selectedShift && (
            <div className="p-4 border-t bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Selected Shift Details
              </h3>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-bold text-lg text-gray-900">{selectedShift.name}</h2>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono mt-1 block w-fit">
                      {selectedShift.jobCode}
                    </code>
                  </div>
                  <StatusBadge status={selectedShift.status} />
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  {selectedShift.time}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {selectedShift.skills.map((skill) => (
                    <Badge
                      key={skill}
                      variant="secondary"
                      className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 font-normal"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Results */}
        <div className="flex-1 bg-gray-50/50 flex flex-col h-1/2 md:h-full">
          <div className="p-6 border-b bg-white">
            <h2 className="text-lg font-semibold text-gray-900">Available Providers</h2>
            <p className="text-sm text-gray-500 mt-1">
              Matching candidates for{" "}
              <span className="font-medium text-gray-900">
                {selectedShift?.jobCode || "selected shift"}
              </span>
            </p>
          </div>

          <ScrollArea className="flex-1 p-6">
            {!selectedShift ? (
              <EmptyState
                icon={<User className="h-8 w-8 text-gray-300" />}
                message="Select a shift to see available providers"
              />
            ) : matchLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-gray-500 mt-4">Finding matches...</p>
              </div>
            ) : providers.length === 0 ? (
              <EmptyState
                icon={<AlertCircle className="h-6 w-6 text-gray-400" />}
                message="No matching providers found"
                description="Try adjusting the skill requirements or check availability for other shifts."
              />
            ) : (
              <div className="space-y-8 max-w-3xl mx-auto">
                {/* Perfect Matches */}
                <ProviderSection
                  title="Perfect Matches"
                  providers={providers.filter((p) => p.matchType === "Perfect")}
                  color="green"
                  assigning={assigning}
                  onAssign={assignProvider}
                />

                {/* Good Matches */}
                <ProviderSection
                  title="Good Matches"
                  providers={providers.filter((p) => p.matchType === "Good")}
                  color="blue"
                  assigning={assigning}
                  onAssign={assignProvider}
                />

                {/* Partial Matches */}
                <ProviderSection
                  title="Partial Matches"
                  providers={providers.filter((p) => p.matchType === "Partial")}
                  color="amber"
                  assigning={assigning}
                  onAssign={assignProvider}
                />
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

// Hospital Node Component
function HospitalNode({
  hospital,
  isExpanded,
  expandedServices,
  selectedShiftId,
  onToggleHospital,
  onToggleService,
  onSelectShift,
}: {
  hospital: BoardHospital
  isExpanded: boolean
  expandedServices: string[]
  selectedShiftId?: string
  onToggleHospital: (id: string) => void
  onToggleService: (id: string) => void
  onSelectShift: (shift: BoardShift) => void
}) {
  return (
    <Collapsible open={isExpanded} onOpenChange={() => onToggleHospital(hospital.id)}>
      <CollapsibleTrigger className="flex items-center w-full p-2 hover:bg-gray-50 rounded-lg group transition-colors">
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-500 mr-2" />
        ) : (
          <ChevronRightIcon className="h-4 w-4 text-gray-500 mr-2" />
        )}
        <Building className="h-4 w-4 text-primary mr-2" />
        <span className="font-medium text-sm flex-1 text-left">{hospital.name}</span>
        {hospital.unfilledCount > 0 && (
          <Badge
            variant="destructive"
            className="ml-2 h-5 min-w-5 flex items-center justify-center text-[10px] rounded-full px-1.5"
          >
            {hospital.unfilledCount}
          </Badge>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-4 pl-4 border-l border-gray-200 space-y-1 py-1">
          {hospital.services.map((service) => (
            <div key={service.id}>
              <button
                onClick={() => onToggleService(service.id)}
                className="flex items-center w-full p-2 hover:bg-gray-50 rounded-lg text-sm group"
              >
                <span className="w-4 mr-2 text-gray-300">
                  {expandedServices.includes(service.id) ? "▼" : "▶"}
                </span>
                <span className="font-medium text-gray-700 flex-1 text-left">{service.name}</span>
                <span className="text-xs text-gray-400 font-mono">({service.unfilledCount})</span>
              </button>

              {expandedServices.includes(service.id) && (
                <div className="ml-6 pl-2 space-y-1 mt-1">
                  {service.shifts.map((shift) => (
                    <button
                      key={shift.id}
                      onClick={() => shift.status === "Open" && onSelectShift(shift)}
                      disabled={shift.status !== "Open"}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border text-sm transition-all",
                        shift.status === "Open" && "hover:shadow-md cursor-pointer",
                        shift.status !== "Open" && "opacity-60 cursor-not-allowed",
                        selectedShiftId === shift.id
                          ? "bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-200"
                          : "bg-white border-gray-100 hover:border-gray-300"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-800">{shift.name}</span>
                        <StatusBadge status={shift.status} />
                      </div>
                      <div className="flex items-center text-xs text-gray-500 gap-3">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {shift.role}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {shift.time}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Open: "bg-red-50 text-red-700 border-red-200",
    Pending: "bg-amber-50 text-amber-700 border-amber-200",
    Filled: "bg-green-50 text-green-700 border-green-200",
  }

  return (
    <Badge variant="outline" className={cn("font-medium border shadow-sm", styles[status] || "")}>
      {status}
    </Badge>
  )
}

// Empty State Component
function EmptyState({
  icon,
  message,
  description,
}: {
  icon: React.ReactNode
  message: string
  description?: string
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 min-h-[400px]">
      <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center">
        {icon}
      </div>
      <p className="font-medium">{message}</p>
      {description && <p className="text-sm text-center max-w-xs">{description}</p>}
    </div>
  )
}

// Provider Section Component
function ProviderSection({
  title,
  providers,
  color,
  assigning,
  onAssign,
}: {
  title: string
  providers: BoardProvider[]
  color: "green" | "blue" | "amber"
  assigning: string | null
  onAssign: (id: string) => void
}) {
  if (providers.length === 0) return null

  const colorClasses = {
    green: {
      text: "text-green-700",
      badge: "bg-green-100 text-green-700 hover:bg-green-100 border-green-200",
      border: "border-l-green-500",
      button: "bg-green-600 hover:bg-green-700",
    },
    blue: {
      text: "text-blue-700",
      badge: "bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200",
      border: "border-l-blue-500",
      button: "bg-blue-600 hover:bg-blue-700",
    },
    amber: {
      text: "text-amber-700",
      badge: "bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200",
      border: "border-l-amber-500",
      button: "bg-amber-600 hover:bg-amber-700",
    },
  }

  const classes = colorClasses[color]

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <h3 className={cn("font-semibold", classes.text)}>{title}</h3>
        <Badge className={cn("shadow-none", classes.badge)}>{providers.length}</Badge>
      </div>
      <div className="space-y-3">
        {providers.map((provider) => (
          <Card key={provider.id} className={cn("border-l-4 transition-all hover:shadow-md", classes.border)}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900">{provider.name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {provider.jobCode} • {provider.department} • {provider.hospital}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {provider.skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                {provider.missingSkills && provider.missingSkills.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 mt-2 bg-red-50 w-fit px-2 py-1 rounded">
                    <AlertCircle className="h-3 w-3" />
                    <span>Missing: {provider.missingSkills.join(", ")}</span>
                  </div>
                )}
              </div>

              <Button
                className={cn("shrink-0 text-white", classes.button)}
                onClick={() => onAssign(provider.id)}
                disabled={!!assigning}
              >
                {assigning === provider.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Assign"
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
