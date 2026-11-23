import { EventUploader } from '@/components/event-uploader'
import { EventTourOverview } from '@/components/event-tour-overview'

export default function EventsPage() {
  return (
    <div className="dashboard-event-studio">
      <EventUploader />
      <EventTourOverview />
    </div>
  )
}
