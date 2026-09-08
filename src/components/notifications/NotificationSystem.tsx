import * as React from "react";
import { useMemo, useState } from "react";
import { Student } from "@/types/student";
import { analyzeStudents, getAlertStats } from "@/utils/notifications";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Bell, 
  Award, 
  AlertTriangle, 
  UserX, 
  TrendingUp, 
  ChevronDown, 
  ChevronUp 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  students: Student[];
  currentYear: string;
}

export const NotificationSystem = ({ students, currentYear }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("all");

  const alerts = useMemo(() => analyzeStudents(students), [students]);
  const stats = useMemo(() => getAlertStats(alerts), [alerts]);

  const filteredAlerts = useMemo(() => {
    if (selectedType === "all") return alerts;
    return alerts.filter(a => a.type === selectedType);
  }, [alerts, selectedType]);

  if (alerts.length === 0) {
    return null;
  }

  const getAlertColor = (type: string) => {
    switch (type) {
      case "excellent":
        return "bg-green-50 border-green-200 text-green-900 dark:bg-green-950 dark:border-green-800 dark:text-green-100";
      case "good":
        return "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100";
      case "needs-attention":
        return "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100";
      case "inactive":
        return "bg-gray-50 border-gray-200 text-gray-900 dark:bg-gray-950 dark:border-gray-800 dark:text-gray-100";
      default:
        return "";
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "excellent":
        return <Award className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case "good":
        return <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case "needs-attention":
        return <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      case "inactive":
        return <UserX className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden print:hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">التنبيهات والإشعارات</h3>
          <Badge variant="secondary" className="font-bold">
            {alerts.length}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {stats.excellent > 0 && (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100">
              <Award className="h-3 w-3 ml-1" />
              {stats.excellent} متميزة
            </Badge>
          )}
          {stats.needsAttention > 0 && (
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-100">
              <AlertTriangle className="h-3 w-3 ml-1" />
              {stats.needsAttention} تحتاج متابعة
            </Badge>
          )}
          {stats.inactive > 0 && (
            <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-100">
              <UserX className="h-3 w-3 ml-1" />
              {stats.inactive} غير نشطة
            </Badge>
          )}
          
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-border">
          {/* Filters */}
          <div className="p-4 bg-accent/30 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={selectedType === "all" ? "default" : "outline"}
              onClick={() => setSelectedType("all")}
            >
              الكل ({alerts.length})
            </Button>
            {stats.excellent > 0 && (
              <Button
                size="sm"
                variant={selectedType === "excellent" ? "default" : "outline"}
                onClick={() => setSelectedType("excellent")}
                className={cn(
                  selectedType === "excellent" && "bg-green-600 hover:bg-green-700"
                )}
              >
                <Award className="h-3 w-3 ml-1" />
                متميزات ({stats.excellent})
              </Button>
            )}
            {stats.good > 0 && (
              <Button
                size="sm"
                variant={selectedType === "good" ? "default" : "outline"}
                onClick={() => setSelectedType("good")}
                className={cn(
                  selectedType === "good" && "bg-blue-600 hover:bg-blue-700"
                )}
              >
                <TrendingUp className="h-3 w-3 ml-1" />
                جيدات ({stats.good})
              </Button>
            )}
            {stats.needsAttention > 0 && (
              <Button
                size="sm"
                variant={selectedType === "needs-attention" ? "default" : "outline"}
                onClick={() => setSelectedType("needs-attention")}
                className={cn(
                  selectedType === "needs-attention" && "bg-amber-600 hover:bg-amber-700"
                )}
              >
                <AlertTriangle className="h-3 w-3 ml-1" />
                يحتجن متابعة ({stats.needsAttention})
              </Button>
            )}
            {stats.inactive > 0 && (
              <Button
                size="sm"
                variant={selectedType === "inactive" ? "default" : "outline"}
                onClick={() => setSelectedType("inactive")}
                className={cn(
                  selectedType === "inactive" && "bg-gray-600 hover:bg-gray-700"
                )}
              >
                <UserX className="h-3 w-3 ml-1" />
                غير نشطات ({stats.inactive})
              </Button>
            )}
          </div>

          {/* Alerts List */}
          <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
            {filteredAlerts.map((alert) => (
              <Alert
                key={`${alert.studentId}-${alert.type}`}
                className={cn("border-r-4", getAlertColor(alert.type))}
              >
                <div className="flex items-start gap-3">
                  {getAlertIcon(alert.type)}
                  <div className="flex-1">
                    <AlertTitle className="flex items-center gap-2 mb-1">
                      <span className="font-bold">{alert.studentName}</span>
                      {alert.rank && (
                        <Badge variant="outline" className="text-xs">
                          المرتبة {alert.rank}
                        </Badge>
                      )}
                    </AlertTitle>
                    <AlertDescription>
                      <div className="text-sm">
                        <div>المعلمة: {alert.teacher}</div>
                        <div className="mt-1 font-medium">{alert.message}</div>
                      </div>
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};