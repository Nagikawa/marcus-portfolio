import { Education } from "@/components/about/education";
import { Experience } from "@/components/about/experience";
import { Stack } from "@/components/about/stack";
import { Nav } from "@/components/layout/nav";

export default function Home() {
  return (
    <main id="main-content" className="flex flex-1 flex-col gap-20 sm:gap-28">
      {/* <Hero />
      <Projects withHeadline viewMoreVisible />
      <ContactCard /> */}
      <Experience />
      <Education />
      <Stack/>      
      <div className="h-12 sm:h-16" />
    </main>
  );
}
