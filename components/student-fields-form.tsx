import type { House, Student } from "@/lib/types/database";
import { NSBM_FACULTIES } from "@/lib/faculties";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function StudentFieldsForm({
  student,
  houses,
  defaults,
}: {
  student?: Student;
  houses: House[];
  defaults?: { faculty?: string; intake?: string };
}) {
  return (
    <>
      <div>
        <Label>Serial No</Label>
        <Input
          name="serial_no"
          type="number"
          defaultValue={student?.serial_no ?? ""}
          placeholder="e.g. 574"
        />
      </div>
      <div>
        <Label>Intake</Label>
        <Input
          name="intake"
          defaultValue={student?.intake ?? defaults?.intake ?? ""}
          placeholder="e.g. 2026.1"
        />
      </div>
      <div>
        <Label>Faculty</Label>
        <Select
          name="faculty"
          defaultValue={student?.faculty ?? defaults?.faculty ?? ""}
        >
          <option value="">Select faculty</option>
          {NSBM_FACULTIES.map((faculty) => (
            <option key={faculty.code} value={faculty.code}>
              {faculty.code} — {faculty.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Student ID</Label>
        <Input
          name="student_id"
          defaultValue={student?.student_id ?? ""}
          placeholder="e.g. 39706"
        />
      </div>
      <div className="sm:col-span-2">
        <Label>Degree Programme</Label>
        <Input
          name="degree_programme"
          defaultValue={student?.degree_programme ?? ""}
          placeholder="Foundation Programme…"
        />
      </div>
      <div>
        <Label>University</Label>
        <Input
          name="university"
          defaultValue={student?.university ?? ""}
          placeholder="e.g. NSBM"
        />
      </div>
      <div>
        <Label>Title</Label>
        <Input name="title" defaultValue={student?.title ?? ""} placeholder="Ms. / Mr." />
      </div>
      <div>
        <Label>Name with Initials</Label>
        <Input name="full_name" defaultValue={student?.full_name ?? ""} required />
      </div>
      <div>
        <Label>Gender</Label>
        <Select name="gender" defaultValue={student?.gender ?? ""}>
          <option value="">—</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </Select>
      </div>
      <div>
        <Label>NIC/Passport</Label>
        <Input name="nic" defaultValue={student?.nic ?? ""} />
      </div>
      <div>
        <Label>Mobile No</Label>
        <Input name="mobile" defaultValue={student?.mobile ?? ""} />
      </div>
      <div>
        <Label>E-Mail</Label>
        <Input
          name="email"
          type="email"
          defaultValue={student?.email ?? ""}
          placeholder="name@example.com"
        />
      </div>
      <div>
        <Label>House (recreation)</Label>
        <Select name="house_id" defaultValue={student?.house_id ?? ""}>
          <option value="">No house yet</option>
          {houses.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </Select>
      </div>
    </>
  );
}
