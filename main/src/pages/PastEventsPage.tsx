import PastEvents from "../components/PastEvents";
import ErrorBoundary from "../components/ErrorBoundary";

export default function PastEventsPage() {
  return (
    <ErrorBoundary>
      <PastEvents />
    </ErrorBoundary>
  );
}
