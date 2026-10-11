import { describe, expect, it } from "vitest";
import { canShowSchoolDetailLink } from "./school-navigation";
import type { MembershipRole } from "@/src/modules/authorization/policy";

describe("school detail navigation hint", () => {
  it.each([
    "SCHOOL_SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "HEAD_OF_SECTION",
    "PRINCIPAL",
    "FORM_TEACHER",
  ] satisfies MembershipRole[])(
    "offers the existing school detail route to %s",
    (role) => {
      expect(canShowSchoolDetailLink("user-a", "school-a", role)).toBe(true);
    },
  );

  it.each(["TEACHER", "PARENT", "STUDENT"] satisfies MembershipRole[])(
    "does not offer inaccessible school details to %s",
    (role) => {
      expect(canShowSchoolDetailLink("user-a", "school-a", role)).toBe(false);
    },
  );

  it("does not offer a link without authenticated user or school identity", () => {
    expect(
      canShowSchoolDetailLink("", "school-a", "SCHOOL_ADMIN"),
    ).toBe(false);
    expect(
      canShowSchoolDetailLink("user-a", "", "SCHOOL_ADMIN"),
    ).toBe(false);
  });
});
