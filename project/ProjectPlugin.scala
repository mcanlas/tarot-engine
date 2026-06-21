import sbt.Keys.*
import sbt.*

object ProjectPlugin extends AutoPlugin {
  val autoImport = ThingsToAutoImport

  override def trigger: PluginTrigger =
    AllRequirements

  object ThingsToAutoImport {
    def module(s: String): Project =
      Project(s, file("."))
        .settings(name := s)
  }
}
